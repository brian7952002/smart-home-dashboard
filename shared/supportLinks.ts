/**
 * Official manufacturer support pages (spec section 10.3).
 *
 * Verified 2026-10-11: each URL returned HTTP 200 (after any same-owner redirect) and is an
 * official support site owned by the manufacturer, either by its own branding/copyright or by
 * being linked from the manufacturer's main website. Re-verify before changing; omit any URL
 * that can't be confirmed rather than substituting a third-party page.
 */
interface SupportLink {
  label: string;
  url: string;
}

const LINKS: Record<string, SupportLink> = {
  "philips hue": { label: "Philips Hue Support", url: "https://www.philips-hue.com/en-us/support" },
  ecobee: { label: "ecobee Help Center", url: "https://support.ecobee.com/" },
  samsung: { label: "Samsung Support (US)", url: "https://www.samsung.com/us/support/" },
  ring: { label: "Ring Help", url: "https://ring.com/support" },
  lifx: { label: "LIFX Support", url: "https://support.lifx.com/hc/en-us" },
  aqara: { label: "Aqara Product Support Center", url: "https://store-support.aqara.com/" },
  nanoleaf: { label: "Nanoleaf Support", url: "https://support.nanoleaf.me/hc/en-us" },
  sensibo: { label: "Sensibo Support Center", url: "https://support.sensibo.com/" },
  lg: { label: "LG Support (US)", url: "https://www.lg.com/us/support" },
  ge: { label: "GE Lighting Cync Support", url: "https://cyncsupport.gelighting.com/" },
};

const ALIASES: Record<string, string> = {
  philips: "philips hue",
  hue: "philips hue",
  "c by ge": "ge",
  cync: "ge",
  "ge lighting": "ge",
};

export function supportLinkFor(manufacturer: string | null | undefined): SupportLink | null {
  if (!manufacturer) return null;
  const key = manufacturer.trim().toLowerCase();
  return LINKS[key] ?? LINKS[ALIASES[key] ?? ""] ?? null;
}
