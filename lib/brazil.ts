export function digitsOnly(value: unknown, maxLength = 32) {
  return typeof value === "string"
    ? value.replace(/\D/g, "").slice(0, maxLength)
    : "";
}

export function isValidCpf(value: unknown) {
  const cpf = digitsOnly(value, 11);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  for (let digitIndex = 9; digitIndex < 11; digitIndex += 1) {
    let sum = 0;
    for (let index = 0; index < digitIndex; index += 1) {
      sum += Number(cpf[index]) * (digitIndex + 1 - index);
    }
    const checkDigit = ((sum * 10) % 11) % 10;
    if (checkDigit !== Number(cpf[digitIndex])) return false;
  }

  return true;
}

export function maskCpf(value: string | null) {
  const cpf = digitsOnly(value, 11);
  return cpf.length === 11 ? `***.***.***-${cpf.slice(-2)}` : "Não informado";
}
