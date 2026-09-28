// Подпись и проверка APK через apksig 2.3.0. Только схема v2: minSdk 24, а v1 в apksig 2.3.0
// опирается на внутренние классы старых JDK и на Java 21 не работает.
//   java -cp apksig.jar Sign.java sign   <in.apk> <out.apk> <keystore> <alias> <minSdk>
//   java -cp apksig.jar Sign.java verify <apk>
// Пароли берутся из переменных окружения KEYSTORE_PASSWORD и KEY_PASSWORD (если нет — тот же, что у хранилища).
import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;
import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class Sign {
  public static void main(String[] a) throws Exception {
    if (a.length >= 6 && a[0].equals("sign")) sign(a);
    else if (a.length == 2 && a[0].equals("verify")) System.exit(verify(new File(a[1])) ? 0 : 1);
    else { System.err.println("usage: sign <in> <out> <keystore> <alias> <minSdk> | verify <apk>"); System.exit(2); }
  }

  static void sign(String[] a) throws Exception {
    String sp = System.getenv("KEYSTORE_PASSWORD"), kp = System.getenv("KEY_PASSWORD");
    if (sp == null || sp.isEmpty()) throw new IllegalStateException("KEYSTORE_PASSWORD не задан");
    if (kp == null || kp.isEmpty()) kp = sp;
    KeyStore ks = KeyStore.getInstance("PKCS12");
    try (FileInputStream in = new FileInputStream(a[3])) { ks.load(in, sp.toCharArray()); }
    String alias = a[4];
    PrivateKey key = (PrivateKey) ks.getKey(alias, kp.toCharArray());
    if (key == null) throw new IllegalStateException("в хранилище нет ключа " + alias);
    List<X509Certificate> certs = new ArrayList<>();
    for (java.security.cert.Certificate c : ks.getCertificateChain(alias)) certs.add((X509Certificate) c);
    ApkSigner.SignerConfig cfg = new ApkSigner.SignerConfig.Builder(alias.toUpperCase(), key, certs).build();
    new ApkSigner.Builder(Collections.singletonList(cfg))
        .setInputApk(new File(a[1])).setOutputApk(new File(a[2]))
        .setMinSdkVersion(Integer.parseInt(a[5]))
        .setV1SigningEnabled(false).setV2SigningEnabled(true)
        .build().sign();
    if (!verify(new File(a[2]))) System.exit(1);
  }

  static boolean verify(File apk) throws Exception {
    ApkVerifier.Result r = new ApkVerifier.Builder(apk).build().verify();
    for (ApkVerifier.IssueWithParams e : r.getErrors()) System.err.println("ERROR: " + e);
    for (ApkVerifier.IssueWithParams w : r.getWarnings()) System.err.println("WARNING: " + w);
    System.out.println("verified=" + r.isVerified() + " v1=" + r.isVerifiedUsingV1Scheme() + " v2=" + r.isVerifiedUsingV2Scheme());
    for (X509Certificate c : r.getSignerCertificates()) {
      byte[] d = MessageDigest.getInstance("SHA-256").digest(c.getEncoded());
      StringBuilder sb = new StringBuilder();
      for (int i = 0; i < d.length; i++) sb.append(i > 0 ? ":" : "").append(String.format("%02X", d[i]));
      System.out.println("signer " + c.getSubjectX500Principal() + " SHA-256 " + sb);
    }
    return r.isVerified();
  }
}
