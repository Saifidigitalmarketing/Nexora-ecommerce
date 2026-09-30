/** Provinces/territories and major cities used by address forms and the location picker. */
export const PROVINCES: { name: string; cities: string[] }[] = [
  { name: "Sindh", cities: ["Karachi", "Hyderabad", "Sukkur", "Larkana", "Mirpurkhas", "Nawabshah"] },
  { name: "Punjab", cities: ["Lahore", "Rawalpindi", "Faisalabad", "Multan", "Gujranwala", "Sialkot", "Bahawalpur", "Sargodha", "Sahiwal"] },
  { name: "Islamabad Capital Territory", cities: ["Islamabad"] },
  { name: "Khyber Pakhtunkhwa", cities: ["Peshawar", "Abbottabad", "Mardan", "Swat", "Kohat", "Dera Ismail Khan"] },
  { name: "Balochistan", cities: ["Quetta", "Gwadar", "Turbat", "Khuzdar"] },
  { name: "Gilgit-Baltistan", cities: ["Gilgit", "Skardu", "Hunza"] },
  { name: "Azad Jammu & Kashmir", cities: ["Muzaffarabad", "Mirpur", "Rawalakot"] },
];

export function provinceForCity(city: string): string | undefined {
  return PROVINCES.find((p) => p.cities.some((c) => c.toLowerCase() === city.toLowerCase()))?.name;
}

/** 03XXXXXXXXX, +923XXXXXXXXX or 00923XXXXXXXXX (matches place_order validation). */
export const PK_MOBILE_RE = /^(\+92|0092|0)?3[0-9]{2}[- ]?[0-9]{7}$/;
