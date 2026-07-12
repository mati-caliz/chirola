-- RenameTable
ALTER TABLE "Emisor" RENAME TO "Issuer";
ALTER TABLE "Certificado" RENAME TO "Certificate";
ALTER TABLE "PuntoVenta" RENAME TO "SalesPoint";
ALTER TABLE "Cliente" RENAME TO "Client";
ALTER TABLE "Comprobante" RENAME TO "Voucher";
ALTER TABLE "ItemComprobante" RENAME TO "VoucherItem";

-- RenameColumn: Issuer
ALTER TABLE "Issuer" RENAME COLUMN "razonSocial" TO "legalName";
ALTER TABLE "Issuer" RENAME COLUMN "condicionIva" TO "ivaCondition";
ALTER TABLE "Issuer" RENAME COLUMN "ambiente" TO "environment";

-- RenameColumn: Certificate
ALTER TABLE "Certificate" RENAME COLUMN "emisorId" TO "issuerId";
ALTER TABLE "Certificate" RENAME COLUMN "validoHasta" TO "validUntil";

-- RenameColumn: SalesPoint
ALTER TABLE "SalesPoint" RENAME COLUMN "emisorId" TO "issuerId";
ALTER TABLE "SalesPoint" RENAME COLUMN "numero" TO "number";
ALTER TABLE "SalesPoint" RENAME COLUMN "descripcion" TO "description";

-- RenameColumn: Client
ALTER TABLE "Client" RENAME COLUMN "emisorId" TO "issuerId";
ALTER TABLE "Client" RENAME COLUMN "tipoDoc" TO "docType";
ALTER TABLE "Client" RENAME COLUMN "numeroDoc" TO "docNumber";
ALTER TABLE "Client" RENAME COLUMN "razonSocial" TO "legalName";
ALTER TABLE "Client" RENAME COLUMN "condicionIva" TO "ivaCondition";

-- RenameColumn: Voucher
ALTER TABLE "Voucher" RENAME COLUMN "emisorId" TO "issuerId";
ALTER TABLE "Voucher" RENAME COLUMN "puntoVentaId" TO "salesPointId";
ALTER TABLE "Voucher" RENAME COLUMN "clienteId" TO "clientId";
ALTER TABLE "Voucher" RENAME COLUMN "tipoCbte" TO "voucherType";
ALTER TABLE "Voucher" RENAME COLUMN "fechaCbte" TO "voucherDate";
ALTER TABLE "Voucher" RENAME COLUMN "concepto" TO "concept";
ALTER TABLE "Voucher" RENAME COLUMN "impNeto" TO "netAmount";
ALTER TABLE "Voucher" RENAME COLUMN "impIva" TO "ivaAmount";
ALTER TABLE "Voucher" RENAME COLUMN "impTotal" TO "totalAmount";
ALTER TABLE "Voucher" RENAME COLUMN "moneda" TO "currency";
ALTER TABLE "Voucher" RENAME COLUMN "cotizacion" TO "exchangeRate";
ALTER TABLE "Voucher" RENAME COLUMN "estado" TO "status";
ALTER TABLE "Voucher" RENAME COLUMN "caeVto" TO "caeExpiration";
ALTER TABLE "Voucher" RENAME COLUMN "arcaObs" TO "arcaObservations";
ALTER TABLE "Voucher" RENAME COLUMN "comprobantesAsoc" TO "associatedVouchers";

-- RenameColumn: VoucherItem
ALTER TABLE "VoucherItem" RENAME COLUMN "comprobanteId" TO "voucherId";
ALTER TABLE "VoucherItem" RENAME COLUMN "descripcion" TO "description";
ALTER TABLE "VoucherItem" RENAME COLUMN "cantidad" TO "quantity";
ALTER TABLE "VoucherItem" RENAME COLUMN "precioUnit" TO "unitPrice";
ALTER TABLE "VoucherItem" RENAME COLUMN "alicuotaIva" TO "ivaRate";

-- RenameConstraint (primary keys)
ALTER TABLE "Issuer" RENAME CONSTRAINT "Emisor_pkey" TO "Issuer_pkey";
ALTER TABLE "Certificate" RENAME CONSTRAINT "Certificado_pkey" TO "Certificate_pkey";
ALTER TABLE "SalesPoint" RENAME CONSTRAINT "PuntoVenta_pkey" TO "SalesPoint_pkey";
ALTER TABLE "Client" RENAME CONSTRAINT "Cliente_pkey" TO "Client_pkey";
ALTER TABLE "Voucher" RENAME CONSTRAINT "Comprobante_pkey" TO "Voucher_pkey";
ALTER TABLE "VoucherItem" RENAME CONSTRAINT "ItemComprobante_pkey" TO "VoucherItem_pkey";

-- RenameConstraint (foreign keys)
ALTER TABLE "Issuer" RENAME CONSTRAINT "Emisor_userId_fkey" TO "Issuer_userId_fkey";
ALTER TABLE "Certificate" RENAME CONSTRAINT "Certificado_emisorId_fkey" TO "Certificate_issuerId_fkey";
ALTER TABLE "SalesPoint" RENAME CONSTRAINT "PuntoVenta_emisorId_fkey" TO "SalesPoint_issuerId_fkey";
ALTER TABLE "Client" RENAME CONSTRAINT "Cliente_emisorId_fkey" TO "Client_issuerId_fkey";
ALTER TABLE "Voucher" RENAME CONSTRAINT "Comprobante_emisorId_fkey" TO "Voucher_issuerId_fkey";
ALTER TABLE "Voucher" RENAME CONSTRAINT "Comprobante_puntoVentaId_fkey" TO "Voucher_salesPointId_fkey";
ALTER TABLE "Voucher" RENAME CONSTRAINT "Comprobante_clienteId_fkey" TO "Voucher_clientId_fkey";
ALTER TABLE "VoucherItem" RENAME CONSTRAINT "ItemComprobante_comprobanteId_fkey" TO "VoucherItem_voucherId_fkey";

-- RenameIndex
ALTER INDEX "Emisor_userId_cuit_ambiente_key" RENAME TO "Issuer_userId_cuit_environment_key";
ALTER INDEX "Certificado_emisorId_key" RENAME TO "Certificate_issuerId_key";
ALTER INDEX "PuntoVenta_emisorId_numero_key" RENAME TO "SalesPoint_issuerId_number_key";
ALTER INDEX "Cliente_emisorId_tipoDoc_numeroDoc_key" RENAME TO "Client_issuerId_docType_docNumber_key";
ALTER INDEX "Comprobante_puntoVentaId_tipoCbte_numero_key" RENAME TO "Voucher_salesPointId_voucherType_number_key";
