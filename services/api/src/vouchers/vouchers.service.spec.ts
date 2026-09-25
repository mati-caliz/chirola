import { PendingVoucherStatus, VoucherStatus } from "@chirola/shared";
import { ArcaRejectionError } from "../arca/wsfe/arca-errors";
import { WebhookEvent } from "../webhooks/webhook-events";
import { VoucherQueuedException } from "./voucher-queued.exception";
import { buildHarness, buildInput } from "./voucher-emission.fixture";

describe("VouchersService — hardening fiscal (F0)", () => {
  it("idempotency: la misma key no reemite y devuelve el mismo comprobante", async () => {
    const { service, wsfe } = buildHarness();

    const first = await service.issue("user-1", buildInput(), "key-abc");
    const second = await service.issue("user-1", buildInput(), "key-abc");

    expect(second.id).toBe(first.id);
    expect(wsfe.requestCae).toHaveBeenCalledTimes(1);
  });

  it("concurrencia: dos emisiones simultáneas del mismo emisor no colisionan de número", async () => {
    const { service } = buildHarness();

    const [issuedVoucher, nextIssuedVoucher] = await Promise.all([
      service.issue("user-1", buildInput()),
      service.issue("user-1", buildInput()),
    ]);

    expect([issuedVoucher.number, nextIssuedVoucher.number].sort((left, right) => left - right)).toEqual([
      1, 2,
    ]);
  });

  it("recuperación de duplicado: si ARCA reporta 10016 recupera el CAE ya emitido", async () => {
    const { service, wsfe } = buildHarness();

    wsfe.requestCae.mockRejectedValueOnce(
      new ArcaRejectionError(["10016"], ["(10016) comprobante duplicado"]),
    );
    wsfe.queryVoucher.mockResolvedValueOnce({
      cae: "74000000000099",
      caeVto: new Date("2026-07-22"),
      observations: [],
    });

    const result = await service.issue("user-1", buildInput());

    expect(result.cae).toBe("74000000000099");
    expect(wsfe.queryVoucher).toHaveBeenCalledTimes(1);
  });

  it("rechazo no-duplicado se propaga como error", async () => {
    const { service, wsfe } = buildHarness();

    wsfe.requestCae.mockRejectedValueOnce(new ArcaRejectionError(["10015"], ["(10015) dato inválido"]));

    await expect(service.issue("user-1", buildInput())).rejects.toBeInstanceOf(ArcaRejectionError);
  });
});

describe("VouchersService — resiliencia / retry (F2)", () => {
  it("error transitorio de ARCA encola el comprobante y responde 503", async () => {
    const { service, wsfe, pending } = buildHarness();
    wsfe.requestCae.mockRejectedValueOnce(new Error("ARCA timeout"));

    await expect(service.issue("user-1", buildInput())).rejects.toBeInstanceOf(VoucherQueuedException);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.status).toBe(PendingVoucherStatus.PENDING);
  });

  it("el retry scheduler emite el CAE de un comprobante encolado y lo desencola", async () => {
    const { service, retries, wsfe, pending, vouchers, webhooks, push } = buildHarness();
    wsfe.requestCae.mockRejectedValueOnce(new Error("ARCA timeout"));

    await expect(service.issue("user-1", buildInput())).rejects.toBeInstanceOf(VoucherQueuedException);
    expect(pending).toHaveLength(1);

    await retries.retryPendingVouchers();

    expect(pending).toHaveLength(0);
    expect(vouchers).toHaveLength(1);
    expect(vouchers[0]?.cae).toBe("74000000000001");
    expect(webhooks.dispatch).toHaveBeenCalledWith(
      "issuer-1",
      WebhookEvent.VOUCHER_ISSUED,
      expect.objectContaining({ voucherId: vouchers[0]?.id }),
    );
    expect(push.notifyIssuerOwner).toHaveBeenCalledWith(
      "issuer-1",
      expect.objectContaining({ data: { voucherId: vouchers[0]?.id } }),
    );
  });

  it("idempotency: reintentar el POST mientras está encolado devuelve 503, sin duplicar la cola", async () => {
    const { service, wsfe, pending } = buildHarness();
    wsfe.requestCae.mockRejectedValueOnce(new Error("ARCA timeout"));

    await expect(service.issue("user-1", buildInput(), "key-1")).rejects.toBeInstanceOf(
      VoucherQueuedException,
    );
    await expect(service.issue("user-1", buildInput(), "key-1")).rejects.toBeInstanceOf(
      VoucherQueuedException,
    );

    expect(pending).toHaveLength(1);
  });

  it("rechazo permanente durante el retry marca ERROR y notifica voucher.failed", async () => {
    const { service, retries, wsfe, pending, webhooks } = buildHarness();
    wsfe.requestCae.mockRejectedValueOnce(new Error("ARCA timeout"));
    await expect(service.issue("user-1", buildInput())).rejects.toBeInstanceOf(VoucherQueuedException);

    wsfe.requestCae.mockRejectedValueOnce(new ArcaRejectionError(["10015"], ["(10015) dato inválido"]));
    await retries.retryPendingVouchers();

    expect(pending[0]?.status).toBe(PendingVoucherStatus.FAILED);
    expect(webhooks.dispatch).toHaveBeenCalledWith(
      "issuer-1",
      WebhookEvent.VOUCHER_FAILED,
      expect.objectContaining({ permanent: true }),
    );
  });
});

describe("VouchersService — reconciliación (D.1)", () => {
  const authorizedInArca = {
    cae: {
      cae: "74000000000077",
      caeVto: new Date("2026-07-22"),
      observations: [],
    },
    number: 1,
    totalAmount: 100,
    recipientDocType: 99,
    recipientDocNumber: "0",
    date: new Date("2026-07-12"),
  };

  it("guarda el número intentado al encolar por error de red", async () => {
    const { service, wsfe, pending } = buildHarness();
    wsfe.requestCae.mockRejectedValueOnce(new Error("ARCA timeout"));

    await expect(service.issue("user-1", buildInput())).rejects.toBeInstanceOf(VoucherQueuedException);

    expect(pending[0]?.attemptedNumber).toBe(1);
    expect(pending[0]?.attemptedSalesPoint).toBe(1);
  });

  it("adopta el CAE ya otorgado en vez de emitir un duplicado", async () => {
    const { service, retries, wsfe, pending, vouchers } = buildHarness();
    wsfe.requestCae.mockRejectedValueOnce(new Error("ARCA timeout"));
    await expect(service.issue("user-1", buildInput())).rejects.toBeInstanceOf(VoucherQueuedException);

    wsfe.queryVoucherDetail.mockResolvedValueOnce(authorizedInArca);
    wsfe.requestCae.mockClear();

    await retries.retryPendingVouchers();

    expect(wsfe.requestCae).not.toHaveBeenCalled();
    expect(pending).toHaveLength(0);
    expect(vouchers).toHaveLength(1);
    expect(vouchers[0]?.cae).toBe("74000000000077");
    expect(vouchers[0]?.status).toBe(VoucherStatus.RECOVERED);
  });

  it("emite normalmente si ARCA no tiene ese número autorizado", async () => {
    const { service, retries, wsfe, vouchers } = buildHarness();
    wsfe.requestCae.mockRejectedValueOnce(new Error("ARCA timeout"));
    await expect(service.issue("user-1", buildInput())).rejects.toBeInstanceOf(VoucherQueuedException);

    await retries.retryPendingVouchers();

    expect(vouchers).toHaveLength(1);
    expect(vouchers[0]?.cae).toBe("74000000000001");
    expect(vouchers[0]?.status).toBe(VoucherStatus.APPROVED);
  });

  it("no adopta un comprobante de ARCA cuyo total no coincide", async () => {
    const { service, retries, wsfe, vouchers } = buildHarness();
    wsfe.requestCae.mockRejectedValueOnce(new Error("ARCA timeout"));
    await expect(service.issue("user-1", buildInput())).rejects.toBeInstanceOf(VoucherQueuedException);

    wsfe.queryVoucherDetail.mockResolvedValueOnce({ ...authorizedInArca, totalAmount: 999 });

    await retries.retryPendingVouchers();

    expect(wsfe.requestCae).toHaveBeenCalled();
    expect(vouchers[0]?.cae).toBe("74000000000001");
  });

  it("no adopta un comprobante de ARCA emitido a otro receptor", async () => {
    const { service, retries, wsfe, vouchers } = buildHarness();
    wsfe.requestCae.mockRejectedValueOnce(new Error("ARCA timeout"));
    await expect(service.issue("user-1", buildInput())).rejects.toBeInstanceOf(VoucherQueuedException);

    wsfe.queryVoucherDetail.mockResolvedValueOnce({
      ...authorizedInArca,
      recipientDocType: 80,
      recipientDocNumber: "30707153745",
    });

    await retries.retryPendingVouchers();

    expect(wsfe.requestCae).toHaveBeenCalled();
    expect(vouchers[0]?.cae).toBe("74000000000001");
  });
});

describe("VouchersService — observaciones de ARCA", () => {
  const observed = {
    cae: "74000000000001",
    caeVto: new Date("2026-07-22"),
    observations: [{ code: "10013", message: "Fecha fuera de rango" }],
  };

  it("marca el comprobante como observado y guarda el aviso", async () => {
    const { service, wsfe, vouchers } = buildHarness();
    wsfe.requestCae.mockResolvedValueOnce(observed);

    await service.issue("user-1", buildInput());

    expect(vouchers[0]?.status).toBe(VoucherStatus.OBSERVED);
    expect(vouchers[0]?.arcaObservations).toEqual(observed.observations);
  });

  it("el comprobante observado sigue teniendo CAE válido", async () => {
    const { service, wsfe, vouchers } = buildHarness();
    wsfe.requestCae.mockResolvedValueOnce(observed);

    await service.issue("user-1", buildInput());

    expect(vouchers[0]?.cae).toBe("74000000000001");
  });

  it("no guarda observaciones cuando ARCA no devuelve ninguna", async () => {
    const { service, vouchers } = buildHarness();

    await service.issue("user-1", buildInput());

    expect(vouchers[0]?.status).toBe(VoucherStatus.APPROVED);
    expect(vouchers[0]?.arcaObservations).toBeNull();
  });
});
