#!/usr/bin/env python3
"""Сборка APK «Мостостроителя» из index.html и шаблона android/template.

    python3 android/build_apk.py --version-name 0.19 --version-code 21 --keystore путь/к/ключу.jks

Пароль — в переменной окружения KEYSTORE_PASSWORD (и KEY_PASSWORD, если у ключа свой).
Без --keystore собирается только неподписанный build/…-unsigned.apk.
Подпись: схема v2 (minSdk 24 — её проверяют все поддерживаемые Android), apksig из Maven Central, скачивается в build/ и сверяется по SHA-1.
"""
import argparse, hashlib, os, re, struct, subprocess, sys, urllib.request, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AND = os.path.join(ROOT, 'android')
TPL = os.path.join(AND, 'template')
BUILD = os.path.join(ROOT, 'build')
APKSIG = ('https://repo1.maven.org/maven2/com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar',
          'apksig-2.3.0.jar')
MIN_SDK = 24
# порядок и сжатие — как в APK 0.18: картинки, шрифты и resources.arsc без сжатия (arsc обязан быть несжатым и выровненным)
ORDER = ['AndroidManifest.xml', 'classes.dex', 'res/', 'resources.arsc', 'assets/fonts/', 'assets/index.html']
STORED = ('.png', '.woff2', '.arsc')


def game_html():
    """index.html для APK: шрифты из assets/fonts вместо Google Fonts и перенос прогресса из APK 0.01."""
    src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    fonts = open(os.path.join(AND, 'fonts.css'), encoding='utf-8').read().strip()
    migrate = open(os.path.join(AND, 'migrate.js'), encoding='utf-8').read().strip()
    out, n = re.subn(r'<link rel="preconnect" href="https://fonts\.googleapis\.com">\n<link rel="stylesheet" href="https://fonts\.googleapis\.com/[^"]*">\n<style>\n',
                     '<style>\n' + fonts + '\n', src)
    if n != 1: sys.exit('не нашёл подключение Google Fonts в index.html')
    out, n = re.subn(r'(\nfunction saveProg\(\)\{[^\n]*\n)', lambda m: m.group(1) + migrate + '\n', out)
    if n != 1: sys.exit('не нашёл saveProg() в index.html')
    return out.encode('utf-8')


# ---- бинарный AndroidManifest.xml: меняем versionCode (число) и versionName (строка в пуле)
def _read_pool(b, off):
    typ, hsz, size, cnt, scnt, flags, sstart, ystart = struct.unpack_from('<HHIIIIII', b, off)
    assert typ == 1 and scnt == 0, 'неожиданный пул строк'
    utf8 = bool(flags & 0x100)
    offs = struct.unpack_from('<%dI' % cnt, b, off + hsz)
    strs = []
    for o in offs:
        p = off + sstart + o
        if utf8:
            n = b[p]; p += 2 if n & 0x80 else 1           # длина в символах
            n = b[p]; p += 1                                # длина в байтах
            if n & 0x80: n = ((n & 0x7f) << 8) | b[p]; p += 1
            strs.append(b[p:p + n].decode('utf-8'))
        else:
            n = struct.unpack_from('<H', b, p)[0]; p += 2
            if n & 0x8000: n = ((n & 0x7fff) << 16) | struct.unpack_from('<H', b, p)[0]; p += 2
            strs.append(b[p:p + 2 * n].decode('utf-16le'))
    return strs, utf8, size


def _write_pool(strs, utf8):
    data, offs = bytearray(), []
    for s in strs:
        offs.append(len(data))
        if utf8:
            e = s.encode('utf-8')
            for n in (len(s), len(e)):
                data += bytes([0x80 | n >> 8, n & 0xff]) if n > 0x7f else bytes([n])
            data += e + b'\0'
        else:
            e = s.encode('utf-16le'); n = len(e) // 2
            data += struct.pack('<HH', 0x8000 | n >> 16, n & 0xffff) if n > 0x7fff else struct.pack('<H', n)
            data += e + b'\0\0'
    while len(data) % 4: data += b'\0'
    hsz = 28; sstart = hsz + 4 * len(strs)
    return struct.pack('<HHIIIIII', 1, hsz, sstart + len(data), len(strs), 0, 0x100 if utf8 else 0, sstart, 0) \
        + struct.pack('<%dI' % len(strs), *offs) + bytes(data)


def patch_manifest(b, vcode, vname):
    typ, hsz, total = struct.unpack_from('<HHI', b, 0)
    assert typ == 3, 'не бинарный XML'
    strs, utf8, psize = _read_pool(b, hsz)
    rest = bytearray(b[hsz + psize:])
    # ищем <manifest> и его атрибуты versionCode / versionName
    p, found = 0, {}
    while p < len(rest):
        ctyp, chsz, csz = struct.unpack_from('<HHI', rest, p)
        if ctyp == 0x0102:
            name = struct.unpack_from('<I', rest, p + 20)[0]
            astart, asz, acnt = struct.unpack_from('<HHH', rest, p + 24)
            if strs[name] == 'manifest':
                for k in range(acnt):
                    q = p + 16 + astart + k * asz
                    an, raw = struct.unpack_from('<II', rest, q + 4)
                    dtype, data = rest[q + 15], struct.unpack_from('<I', rest, q + 16)[0]
                    found[strs[an]] = (q, raw, dtype, data)
                break
        p += csz
    q, raw, dtype, data = found['versionCode']
    assert dtype == 0x10, 'versionCode не число'
    old_code = data
    struct.pack_into('<I', rest, q + 16, vcode)
    q, raw, dtype, data = found['versionName']
    assert dtype == 0x03 and raw == data, 'versionName не строка'
    old_name = strs[raw]
    if sum(1 for v in found.values() if v[1] == raw) != 1: sys.exit('строка versionName используется ещё где-то')
    strs = list(strs); strs[raw] = vname
    pool = _write_pool(strs, utf8)
    out = struct.pack('<HHI', 3, hsz, hsz + len(pool) + len(rest)) + pool + bytes(rest)
    return out, old_code, old_name


# ---- zip: детерминированный, несжатые записи выровнены на 4 байта (как после zipalign)
def write_zip(path, entries):
    with zipfile.ZipFile(path, 'w') as z:
        for name, data in entries:
            zi = zipfile.ZipInfo(name, date_time=(2008, 1, 1, 0, 0, 0))
            zi.create_system = 0; zi.external_attr = 0
            if name.endswith(STORED):
                zi.compress_type = zipfile.ZIP_STORED
                off = z.fp.tell() + 30 + len(name.encode())
                zi.extra = b'\0' * ((-off) % 4)
            else:
                zi.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(zi, data, compresslevel=9)


def template_entries():
    files = []
    for dp, _, fs in os.walk(TPL):
        for f in fs:
            full = os.path.join(dp, f)
            files.append(os.path.relpath(full, TPL).replace(os.sep, '/'))
    key = lambda n: (next(i for i, p in enumerate(ORDER) if n == p or (p.endswith('/') and n.startswith(p))), n)
    return sorted(files, key=key)


def apksig_jar():
    url, name = APKSIG
    jar = os.path.join(BUILD, name)
    if not os.path.exists(jar):
        os.makedirs(BUILD, exist_ok=True)
        get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'curl/8'}), timeout=60).read()
        data, sha1 = get(url), get(url + '.sha1').decode().split()[0]
        if hashlib.sha1(data).hexdigest() != sha1: sys.exit('apksig: не сошлась SHA-1')
        open(jar, 'wb').write(data)
    return jar


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--version-name', required=True)
    ap.add_argument('--version-code', type=int, required=True)
    ap.add_argument('--keystore')
    ap.add_argument('--alias', default=os.environ.get('KEY_ALIAS', 'game'))
    a = ap.parse_args()
    os.makedirs(BUILD, exist_ok=True)
    base = os.path.join(BUILD, 'Mostostroitel-' + a.version_name)
    entries = []
    for n in template_entries():
        data = open(os.path.join(TPL, n), 'rb').read()
        if n == 'AndroidManifest.xml':
            data, oc, on = patch_manifest(data, a.version_code, a.version_name)
            if a.version_code <= oc: sys.exit('versionCode %d должен быть больше, чем в шаблоне (%d)' % (a.version_code, oc))
            print('манифест: versionCode %d -> %d, versionName %s -> %s' % (oc, a.version_code, on, a.version_name))
        entries.append((n, data))
    entries.append(('assets/index.html', game_html()))
    unsigned = base + '-unsigned.apk'
    write_zip(unsigned, entries)
    print('собран', os.path.relpath(unsigned, ROOT))
    if not a.keystore: return
    out = base + '.apk'
    # apksig 2.3.0 при загрузке трогает внутренний класс JDK sun.security.x509 даже без подписи v1
    subprocess.run(['java', '--add-exports', 'java.base/sun.security.x509=ALL-UNNAMED', '-cp', apksig_jar(), os.path.join(AND, 'Sign.java'), 'sign',
                    unsigned, out, a.keystore, a.alias, str(MIN_SDK)], check=True)
    print('подписан', os.path.relpath(out, ROOT))


if __name__ == '__main__':
    main()
