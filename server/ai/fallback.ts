import type { DeviceType } from "../../shared/constants";
import type { ChatTurn } from "../../shared/validation";
import type { DiagnosisResponse, GuideResponse } from "../../shared/ai";
import type { AiDeviceContext } from "./context";

/**
 * Local, device-type-specific guidance used whenever the AI provider is unavailable.
 * Never includes an estimated success rate: there is no basis for one here.
 */

interface TypeGuide {
  overview: string;
  reset: string;
  quickFixes: string[];
  commonIssues: Array<{ issue: string; solution: string }>;
  maintenanceTips: string[];
  advancedTroubleshooting: string[];
  possibleCauses: string[];
}

const GUIDES: Record<DeviceType, TypeGuide> = {
  light: {
    reset: "Most smart bulbs reset with a timed power-cycle sequence at the wall switch; the exact pattern is in the manufacturer's app or manual.",
    overview:
      "Smart lights depend on steady power at the switch and a reliable link to their hub or Wi-Fi network. Most problems come from a wall switch being turned off, weak signal, or a hub that needs a restart.",
    quickFixes: [
      "Make sure the wall switch or lamp switch is on.",
      "Turn the light off at the switch for 10 seconds, then back on.",
      "Restart the hub or bridge the light connects through.",
    ],
    commonIssues: [
      { issue: "Light shows as offline", solution: "Check the physical switch, then power-cycle the bulb and its hub." },
      { issue: "Light responds slowly", solution: "Move the hub closer or add a repeater to strengthen the mesh or Wi-Fi signal." },
      { issue: "Wrong color or brightness", solution: "Update the bulb's firmware in the manufacturer's app and recalibrate scenes." },
    ],
    maintenanceTips: [
      "Keep bulb and hub firmware up to date.",
      "Avoid controlling smart bulbs with dimmer switches not rated for them.",
      "Leave wall switches on so the bulb stays reachable.",
    ],
    advancedTroubleshooting: [
      "Remove the bulb from the manufacturer's app and pair it again.",
      "Factory-reset the bulb using the manufacturer's documented power-cycle sequence.",
      "Check the router for 2.4 GHz availability if the bulb uses Wi-Fi.",
    ],
    possibleCauses: ["Wall switch turned off", "Weak hub or Wi-Fi signal", "Hub or bridge needs a restart", "Outdated firmware"],
  },
  climate: {
    reset: "Thermostats and AC controllers usually have a restart or factory-reset option in their on-device or in-app settings menu. A restart is safer to try first.",
    overview:
      "Smart thermostats and AC controllers need stable power and Wi-Fi to report status and accept changes. Connectivity issues are common after router changes or power interruptions.",
    quickFixes: [
      "Confirm the router is working and other devices are online.",
      "Restart the thermostat or controller from its settings menu, or briefly cut its power.",
      "Check that the device is still connected to the right Wi-Fi network.",
    ],
    commonIssues: [
      { issue: "Network connectivity error", solution: "Restart the router and the device, then rejoin Wi-Fi if the network name or password changed." },
      { issue: "Temperature doesn't change", solution: "Check the HVAC system's own power and mode, and confirm the target temperature was saved." },
      { issue: "Inaccurate readings", solution: "Keep the device away from direct sunlight, vents, and heat sources." },
    ],
    maintenanceTips: [
      "Keep firmware current.",
      "Replace HVAC filters on the manufacturer's schedule.",
      "Check that remote sensors have fresh batteries.",
    ],
    advancedTroubleshooting: [
      "Review the device's network diagnostics in the manufacturer's app.",
      "Assign the device a reserved IP address in the router.",
      "For wiring or power problems at the wall, contact a qualified HVAC technician or electrician.",
    ],
    possibleCauses: ["Router or Wi-Fi change", "Power interruption", "Weak signal at the device", "Firmware issue"],
  },
  security: {
    reset: "Cameras and sensors typically reset by holding a small reset button for several seconds, then re-adding the device in the manufacturer's app.",
    overview:
      "Cameras and sensors must stay connected to report events. Connection errors usually trace back to Wi-Fi signal, batteries, or the hub they report to.",
    quickFixes: [
      "Check the battery or power adapter.",
      "Restart the sensor or camera and the hub it reports to.",
      "Move the device or hub closer together to rule out signal problems.",
    ],
    commonIssues: [
      { issue: "Connection error", solution: "Power-cycle the device and hub, then confirm the hub is online." },
      { issue: "Missed motion events", solution: "Review sensitivity and detection-zone settings, and clear obstructions." },
      { issue: "Camera feed won't load", solution: "Check upload bandwidth and lower the stream quality if needed." },
    ],
    maintenanceTips: [
      "Replace batteries before they run out.",
      "Keep lenses and sensor windows clean.",
      "Keep firmware current for security fixes.",
    ],
    advancedTroubleshooting: [
      "Remove and re-add the device in the manufacturer's app.",
      "Check the hub's event log for repeated disconnects.",
      "Test with the hub moved to a central location to reduce interference.",
    ],
    possibleCauses: ["Low battery", "Hub offline", "Wi-Fi or mesh interference", "Device moved out of range"],
  },
  media: {
    reset: "Try a cold restart first (unplug for 60 seconds). If problems continue, the TV's support menu has options to reset the smart hub or network settings; this signs you out of apps.",
    overview:
      "TVs and media devices rely on network services for smart features. Most problems are fixed by restarting the device and its network connection, or by installing pending updates.",
    quickFixes: [
      "Restart the TV by unplugging it for 60 seconds.",
      "Check the TV's network settings and test the connection.",
      "Install any pending software updates.",
    ],
    commonIssues: [
      { issue: "Smart hub or apps not responding", solution: "Cold-restart the TV, then check for a software update; reset the smart hub from the TV's support menu if it continues." },
      { issue: "Device shows offline", solution: "Make sure the TV is plugged in and that network standby or remote power-on is enabled." },
      { issue: "Apps buffering", solution: "Use a wired connection or move the router closer." },
    ],
    maintenanceTips: [
      "Enable automatic software updates.",
      "Keep network standby enabled so the app can reach the TV.",
      "Remove unused apps to free storage.",
    ],
    advancedTroubleshooting: [
      "Reset the smart hub or network settings from the TV's support menu (this signs you out of apps).",
      "Check the router for blocked ports or parental controls affecting the TV.",
      "Contact the manufacturer's support if a factory reset doesn't help.",
    ],
    possibleCauses: ["Smart platform service hang", "Network standby disabled", "Pending software update", "Weak Wi-Fi"],
  },
};

export function fallbackGuide(ctx: AiDeviceContext): GuideResponse {
  const g = GUIDES[ctx.type];
  const quickFixes = [...g.quickFixes];
  if (ctx.hasError && !ctx.errorFixable) {
    quickFixes.unshift("This error can't be cleared remotely. Work through these steps, then power-cycle the device.");
  } else if (ctx.hasError || !ctx.isOnline) {
    quickFixes.unshift("Try the simulated remote reconnect in this app first.");
  }
  return {
    source: "fallback",
    overview: g.overview,
    quickFixes,
    commonIssues: g.commonIssues,
    maintenanceTips: g.maintenanceTips,
    advancedTroubleshooting: g.advancedTroubleshooting,
    possibleCauses: g.possibleCauses,
  };
}

export function fallbackDiagnosis(ctx: AiDeviceContext): DiagnosisResponse {
  const g = GUIDES[ctx.type];
  const error = ctx.errorMessage ? `"${ctx.errorMessage}"` : "This error";
  const diagnosis = ctx.errorFixable
    ? `${error} usually points to a temporary connection problem. A remote reconnect often clears it; if it comes back, check the network steps below.`
    : `${error} usually needs hands-on troubleshooting at the device. These general steps are a safe place to start.`;
  return {
    source: "fallback",
    diagnosis,
    steps: g.quickFixes.concat(g.advancedTroubleshooting.slice(0, 1)),
    possibleCauses: g.possibleCauses,
  };
}

export function fallbackChat(ctx: AiDeviceContext, question: string, _history: ChatTurn[]): string {
  const g = GUIDES[ctx.type];
  const q = question.toLowerCase();
  if (/(reset|factory|restart)/.test(q)) return `${g.reset} Only factory-reset after the simpler steps fail, since it may remove settings.`;
  if (/(offline|connect|wifi|wi-fi|network)/.test(q)) return `For connection problems: ${g.commonIssues[0].solution} ${g.quickFixes[1]}`;
  if (/(firmware|update)/.test(q)) {
    const fw = ctx.firmwareVersion ? `This device reports firmware ${ctx.firmwareVersion}. ` : "";
    return `${fw}Check the manufacturer's app for available updates; I can't look up the latest version while offline.`;
  }
  if (ctx.hasError) return `For "${ctx.errorMessage}": ${g.quickFixes.join(" ")}`;
  return `${g.overview} A good first step: ${g.quickFixes[0]}`;
}
