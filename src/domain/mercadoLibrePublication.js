export const buildMercadoLibrePublication = (publish, publication) =>
  publish ? { ...publication, publish: true } : null;

const hasValue = (value) => Boolean(value?.valueId || String(value?.valueName || '').trim());

export const validateMercadoLibrePublicationAttributes = (attributes, values, condition) => {
  const gtin = attributes.find((attribute) => attribute.id === 'GTIN');
  const emptyReason = attributes.find((attribute) => attribute.id === 'EMPTY_GTIN_REASON');
  const gtinValue = values.GTIN || {};
  const reasonValue = values.EMPTY_GTIN_REASON || {};
  const required = (attribute) => attribute.required || (condition === 'new' && attribute.newRequired);
  const missing = attributes.find((attribute) => attribute.id !== 'GTIN' &&
    !(attribute.id === 'EMPTY_GTIN_REASON' && hasValue(gtinValue)) &&
    required(attribute) && !hasValue(values[attribute.id]));
  if (missing) return `Completa el atributo obligatorio: ${missing.name || missing.id}.`;
  if (hasValue(gtinValue) && hasValue(reasonValue)) {
    return 'Indica el GTIN real o el motivo por el que no tiene código, no ambos.';
  }
  if (hasValue(gtinValue)) {
    if (gtinValue.valueId) {
      const allowed = gtin?.values?.find((value) => value.id === gtinValue.valueId);
      if (!allowed || (gtinValue.valueName && gtinValue.valueName !== allowed.name)) return 'Selecciona un GTIN admitido por la categoría.';
    } else {
      const digits = String(gtinValue.valueName || '').trim();
      if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(digits) || /^0+$/.test(digits)) {
        return 'El GTIN debe ser el código real del envase (8, 12, 13 o 14 dígitos). No uses el SKU ni inventes uno.';
      }
      const checksum = [...digits.slice(0, -1)].reverse().reduce((sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
      if ((10 - checksum % 10) % 10 !== Number(digits.at(-1))) return 'El GTIN no tiene un dígito verificador válido. Revisa el código del envase.';
    }
  }
  if (hasValue(reasonValue)) {
    const allowed = emptyReason?.values?.find((value) => value.id === reasonValue.valueId);
    if (!allowed || (reasonValue.valueName && reasonValue.valueName !== allowed.name)) {
      return 'Selecciona un motivo de GTIN vacío ofrecido por la categoría; no inventes uno.';
    }
  }
  if (gtin && (required(gtin) || gtin.conditionalRequired) && !hasValue(gtinValue) && !hasValue(reasonValue)) {
    return emptyReason?.values?.length
      ? 'Mercado Libre requiere un GTIN real o un motivo de GTIN vacío permitido por la categoría. Si no corresponde ninguno, desactiva la publicación y guarda el producto solo en VIDKAR.'
      : 'Mercado Libre requiere el GTIN real de este producto y la categoría no ofrece un motivo sin código. No inventes uno: desactiva la publicación y guarda el producto solo en VIDKAR.';
  }
  return '';
};
