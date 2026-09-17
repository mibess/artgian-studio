import { z } from "zod";

export const BRAZIL_STATES = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;
const requiredText = (name: string, max: number) => z.string().trim().min(1, `Informe ${name}.`).max(max, `${name}: use até ${max} caracteres.`);

export const addressSchema = z.object({
  label: z.string().trim().max(40, "Identificação: use até 40 caracteres.").default(""),
  postalCode: z.string().trim().regex(/^\d{5}-?\d{3}$/, "Informe um CEP válido com 8 dígitos.").transform(value => value.replace("-", "")),
  streetAddress: requiredText("o endereço", 180),
  addressNumber: requiredText("o número (ou S/N)", 20),
  addressComplement: z.string().trim().max(80, "Complemento: use até 80 caracteres.").default(""),
  neighborhood: requiredText("o bairro", 80),
  city: requiredText("a cidade", 80),
  state: z.string().trim().toUpperCase().pipe(z.enum(BRAZIL_STATES, "Selecione uma UF válida.")),
});

export type AddressInput = z.infer<typeof addressSchema>;
export type AddressDraft = Omit<AddressInput, "state"> & { state: string };
export type SavedAddress = AddressInput & { id: string; isDefault: boolean };
export const emptyAddress: AddressDraft = {
  label: "", postalCode: "", streetAddress: "", addressNumber: "",
  addressComplement: "", neighborhood: "", city: "", state: "",
};
export function formatPostalCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
}
