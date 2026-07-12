-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Emisor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "condicionIva" TEXT NOT NULL,
    "ambiente" TEXT NOT NULL DEFAULT 'homologacion',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Emisor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificado" (
    "id" TEXT NOT NULL,
    "emisorId" TEXT NOT NULL,
    "privateKeyEnc" TEXT NOT NULL,
    "certPem" TEXT,
    "alias" TEXT,
    "validoHasta" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PuntoVenta" (
    "id" TEXT NOT NULL,
    "emisorId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "PuntoVenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "emisorId" TEXT NOT NULL,
    "tipoDoc" INTEGER NOT NULL,
    "numeroDoc" TEXT NOT NULL,
    "razonSocial" TEXT,
    "condicionIva" TEXT,
    "email" TEXT,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comprobante" (
    "id" TEXT NOT NULL,
    "emisorId" TEXT NOT NULL,
    "puntoVentaId" TEXT NOT NULL,
    "clienteId" TEXT,
    "tipoCbte" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "fechaCbte" TIMESTAMP(3) NOT NULL,
    "concepto" INTEGER NOT NULL,
    "impNeto" DECIMAL(15,2) NOT NULL,
    "impIva" DECIMAL(15,2) NOT NULL,
    "impTotal" DECIMAL(15,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PES',
    "cotizacion" DECIMAL(15,6) NOT NULL DEFAULT 1,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "cae" TEXT,
    "caeVto" TIMESTAMP(3),
    "qrData" TEXT,
    "arcaObs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comprobante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemComprobante" (
    "id" TEXT NOT NULL,
    "comprobanteId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "precioUnit" DECIMAL(15,4) NOT NULL,
    "alicuotaIva" DECIMAL(5,2) NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "ItemComprobante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Emisor_userId_cuit_ambiente_key" ON "Emisor"("userId", "cuit", "ambiente");

-- CreateIndex
CREATE UNIQUE INDEX "Certificado_emisorId_key" ON "Certificado"("emisorId");

-- CreateIndex
CREATE UNIQUE INDEX "PuntoVenta_emisorId_numero_key" ON "PuntoVenta"("emisorId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_emisorId_tipoDoc_numeroDoc_key" ON "Cliente"("emisorId", "tipoDoc", "numeroDoc");

-- CreateIndex
CREATE UNIQUE INDEX "Comprobante_puntoVentaId_tipoCbte_numero_key" ON "Comprobante"("puntoVentaId", "tipoCbte", "numero");

-- AddForeignKey
ALTER TABLE "Emisor" ADD CONSTRAINT "Emisor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificado" ADD CONSTRAINT "Certificado_emisorId_fkey" FOREIGN KEY ("emisorId") REFERENCES "Emisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuntoVenta" ADD CONSTRAINT "PuntoVenta_emisorId_fkey" FOREIGN KEY ("emisorId") REFERENCES "Emisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_emisorId_fkey" FOREIGN KEY ("emisorId") REFERENCES "Emisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comprobante" ADD CONSTRAINT "Comprobante_emisorId_fkey" FOREIGN KEY ("emisorId") REFERENCES "Emisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comprobante" ADD CONSTRAINT "Comprobante_puntoVentaId_fkey" FOREIGN KEY ("puntoVentaId") REFERENCES "PuntoVenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comprobante" ADD CONSTRAINT "Comprobante_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemComprobante" ADD CONSTRAINT "ItemComprobante_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "Comprobante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
