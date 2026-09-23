// Browser-only SDK double. Tests never send card data or make real payments.
// Match the dot-separated format observed in Mercado Pago's real security SDK.
window.MP_DEVICE_SESSION_ID = `${"a".repeat(70)}.${"b".repeat(90)}.${"c".repeat(69)}`;
window.MercadoPago = class {
  cardForm({ form, iframe, callbacks }) {
    if (!iframe) throw new Error("Secure iframes must be enabled");
    const element = document.getElementById(form.id);
    const frames = ["cardNumber", "expirationDate", "securityCode"].map(name => {
      const frame = document.createElement("iframe");
      frame.title = form[name].placeholder;
      frame.srcdoc = `<html><body style="margin:0"><input aria-label="${form[name].placeholder}" placeholder="${form[name].placeholder}" style="box-sizing:border-box;width:100%;height:24px;border:0;outline:0;font:16px Arial;color:#0b2447;background:white" /></body></html>`;
      frame.style.border = "0";
      document.getElementById(form[name].id).append(frame);
      return frame;
    });
    for (const [name, value, text] of [["issuer", "25", "Banco do cartão"], ["installments", "1", "1x sem juros"], ["identificationType", "CPF", "CPF"]]) {
      document.getElementById(form[name].id).innerHTML = `<option value="${value}">${text}</option>`;
    }
    let tokenReady = false;
    const submit = event => {
      event.preventDefault();
      if (frames.some(frame => !frame.contentDocument.querySelector("input").value)) callbacks.onError([{ message: "Invalid fields" }]);
      else if (tokenReady) callbacks.onSubmit(event);
      // The real CardForm requests a second submit after asynchronous tokenization.
      else setTimeout(() => { tokenReady = true; element.requestSubmit(); }, 0);
    };
    element.addEventListener("submit", submit);
    queueMicrotask(() => { callbacks.onFormMounted(); callbacks.onReady(); });
    return {
      getCardFormData: () => ({ token: "test-token-from-secure-sdk", paymentMethodId: "visa", issuerId: "25", installments: "1", identificationNumber: document.getElementById(form.identificationNumber.id).value }),
      unmount() { frames.forEach(frame => frame.remove()); element.removeEventListener("submit", submit); },
    };
  }
};
