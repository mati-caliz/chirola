import { PrismaClient } from "@prisma/client";
import { normalizeCuit } from "@chirola/shared";
import { certificateHolderCuit } from "../src/certs/certificate-subject";
import * as forge from "node-forge";

const prisma = new PrismaClient();

type Finding = {
  issuerId: string;
  cuit: string;
  environment: string;
  representativeCuit: string | null;
  holderCuit: string | null;
  verdict: string;
};

function verdictFor(expectedHolderCuit: string, holderCuit: string | null): string {
  if (!holderCuit) return "SIN CUIT EN EL CERTIFICADO";
  return holderCuit === expectedHolderCuit ? "OK" : "NO COINCIDE";
}

async function main(): Promise<void> {
  const issuers = await prisma.issuer.findMany({
    include: { certificate: { select: { certPem: true } } },
    orderBy: { createdAt: "asc" },
  });

  const findings: Finding[] = issuers.map((issuer) => {
    const certPem = issuer.certificate?.certPem ?? null;
    const holderCuit = certPem ? certificateHolderCuit(forge.pki.certificateFromPem(certPem)) : null;
    const expectedHolderCuit = normalizeCuit(issuer.representativeCuit ?? issuer.cuit);
    return {
      issuerId: issuer.id,
      cuit: issuer.cuit,
      environment: issuer.environment,
      representativeCuit: issuer.representativeCuit,
      holderCuit,
      verdict: certPem ? verdictFor(expectedHolderCuit, holderCuit) : "SIN CERTIFICADO",
    };
  });

  console.table(findings);

  const mismatched = findings.filter(({ verdict }) => verdict === "NO COINCIDE");
  if (mismatched.length > 0) {
    console.error(
      `\n${mismatched.length} emisor(es) tienen cargado el certificado de otro CUIT. ` +
        "Esos emisores no pueden facturar hasta que se cargue el certificado correcto " +
        "o se declare el representante.",
    );
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
