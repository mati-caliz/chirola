import * as forge from "node-forge";
import { certificateHolderCuit } from "./certificate-subject";

function certificateWithSubject(subject: forge.pki.CertificateField[]): forge.pki.Certificate {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 512 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 86_400_000);
  cert.setSubject(subject);
  cert.setIssuer(subject);
  cert.sign(keys.privateKey);
  return cert;
}

describe("certificateHolderCuit", () => {
  it("lee el cuit del serialNumber del subject", () => {
    const cert = certificateWithSubject([
      { shortName: "CN", value: "chirola" },
      { name: "serialNumber", value: "CUIT 20435734678" },
    ]);
    expect(certificateHolderCuit(cert)).toBe("20435734678");
  });

  it("ignora los separadores del serialNumber", () => {
    const cert = certificateWithSubject([
      { shortName: "CN", value: "chirola" },
      { name: "serialNumber", value: "CUIT 20-43573467-8" },
    ]);
    expect(certificateHolderCuit(cert)).toBe("20435734678");
  });

  it("devuelve null si el subject no tiene serialNumber", () => {
    const cert = certificateWithSubject([{ shortName: "CN", value: "chirola" }]);
    expect(certificateHolderCuit(cert)).toBeNull();
  });

  it("devuelve null si el serialNumber no es un cuit", () => {
    const cert = certificateWithSubject([
      { shortName: "CN", value: "chirola" },
      { name: "serialNumber", value: "12345" },
    ]);
    expect(certificateHolderCuit(cert)).toBeNull();
  });
});
