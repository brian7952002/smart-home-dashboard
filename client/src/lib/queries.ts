import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatResponse, DiagnosisResponse, GuideResponse } from "@shared/ai";
import type {
  AppConfig,
  Automation,
  Device,
  DeviceEvent,
  ReconnectResult,
  Room,
  RoomWithDevices,
  Scenario,
} from "@shared/types";
import type {
  ChatTurn,
  CreateAutomationInput,
  CreateDeviceInput,
  CreateScenarioInput,
  UpdateDeviceInput,
} from "@shared/validation";
import type { RoomSize } from "@shared/constants";
import { ApiError, api } from "./api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      // Don't retry client errors such as 404s; retry transient failures twice.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
    mutations: { retry: false },
  },
});

export const keys = {
  config: ["config"] as const,
  roomsWithDevices: ["rooms-with-devices"] as const,
  rooms: ["rooms"] as const,
  devices: ["devices"] as const,
  device: (id: number) => ["device", id] as const,
  events: (id: number) => ["device", id, "events"] as const,
  guide: (id: number, version: string) => ["guide", id, version] as const,
  scenarios: ["scenarios"] as const,
  automations: ["automations"] as const,
};

// ---------- Queries ----------

export const useConfig = () =>
  useQuery({ queryKey: keys.config, queryFn: () => api<AppConfig>("GET", "/api/config"), staleTime: Infinity });

export const useRoomsWithDevices = () =>
  useQuery({ queryKey: keys.roomsWithDevices, queryFn: () => api<RoomWithDevices[]>("GET", "/api/rooms-with-devices") });

export const useDevices = () => useQuery({ queryKey: keys.devices, queryFn: () => api<Device[]>("GET", "/api/devices") });

export const useDevice = (id: number | null) =>
  useQuery({
    queryKey: keys.device(id ?? -1),
    queryFn: () => api<Device>("GET", `/api/devices/${id}`),
    enabled: id !== null,
  });

export const useDeviceEvents = (id: number, enabled = true) =>
  useQuery({
    queryKey: keys.events(id),
    queryFn: () => api<DeviceEvent[]>("GET", `/api/devices/${id}/events?limit=10`),
    enabled,
  });

/** POST, but idempotent and cached server-side by device state, so it's safe as a query. */
export const useGuide = (device: Device | undefined, enabled: boolean) =>
  useQuery({
    queryKey: keys.guide(device?.id ?? -1, device?.updatedAt ?? ""),
    queryFn: () => api<GuideResponse>("POST", `/api/ai/devices/${device!.id}/guide`),
    enabled: enabled && !!device,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

export const useScenarios = () => useQuery({ queryKey: keys.scenarios, queryFn: () => api<Scenario[]>("GET", "/api/scenarios") });

export const useAutomations = () =>
  useQuery({ queryKey: keys.automations, queryFn: () => api<Automation[]>("GET", "/api/automations") });

// ---------- Mutations ----------

function useInvalidateHome() {
  const qc = useQueryClient();
  return (deviceId?: number) => {
    void qc.invalidateQueries({ queryKey: keys.devices });
    void qc.invalidateQueries({ queryKey: keys.roomsWithDevices });
    void qc.invalidateQueries({ queryKey: keys.rooms });
    if (deviceId !== undefined) void qc.invalidateQueries({ queryKey: keys.device(deviceId) });
  };
}

/** Writes a fresh device into every cache that holds it, then refetches in the background. */
function usePutDevice() {
  const qc = useQueryClient();
  const invalidate = useInvalidateHome();
  return (device: Device) => {
    qc.setQueryData(keys.device(device.id), device);
    qc.setQueryData<Device[]>(keys.devices, (list) => list?.map((d) => (d.id === device.id ? device : d)));
    qc.setQueryData<RoomWithDevices[]>(keys.roomsWithDevices, (rooms) =>
      rooms?.map((r) => ({ ...r, devices: r.devices.map((d) => (d.id === device.id ? device : d)) })),
    );
    invalidate(device.id);
  };
}

export function usePower() {
  const put = usePutDevice();
  return useMutation({
    mutationFn: ({ id, isOn }: { id: number; isOn: boolean }) => api<Device>("PUT", `/api/devices/${id}/power`, { isOn }),
    onSuccess: put,
  });
}

export function useReconnect() {
  const put = usePutDevice();
  return useMutation({
    mutationFn: (id: number) => api<ReconnectResult>("POST", `/api/devices/${id}/reconnect`),
    onSuccess: (res) => put(res.device),
  });
}

export function useUpdateDevice() {
  const put = usePutDevice();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateDeviceInput & { id: number }) => api<Device>("PATCH", `/api/devices/${id}`, input),
    onSuccess: put,
  });
}

export function useSimulateError() {
  const put = usePutDevice();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number; errorMessage: string; fixable: boolean }) =>
      api<Device>("POST", `/api/devices/${id}/simulate-error`, input),
    onSuccess: put,
  });
}

export function useCreateDevice() {
  const invalidate = useInvalidateHome();
  return useMutation({
    mutationFn: (input: CreateDeviceInput) => api<Device>("POST", "/api/devices", input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteDevice() {
  const qc = useQueryClient();
  const invalidate = useInvalidateHome();
  return useMutation({
    mutationFn: (id: number) => api<void>("DELETE", `/api/devices/${id}`),
    onSuccess: (_r, id) => {
      qc.removeQueries({ queryKey: keys.device(id) });
      invalidate();
    },
  });
}

export function useCreateRoom() {
  const invalidate = useInvalidateHome();
  return useMutation({
    mutationFn: (input: { name: string; size: RoomSize }) => api<Room>("POST", "/api/rooms", input),
    onSuccess: () => invalidate(),
  });
}

export function useRenameRoom() {
  const invalidate = useInvalidateHome();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => api<Room>("PATCH", `/api/rooms/${id}`, { name }),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteRoom() {
  const invalidate = useInvalidateHome();
  return useMutation({
    mutationFn: (id: number) => api<void>("DELETE", `/api/rooms/${id}`),
    onSuccess: () => invalidate(),
  });
}

export function useSaveLayout() {
  const invalidate = useInvalidateHome();
  return useMutation({
    mutationFn: (rooms: Array<{ id: number; positionX: number; positionY: number }>) =>
      api<Room[]>("PUT", "/api/rooms/layout", { rooms }),
    onSuccess: () => invalidate(),
  });
}

export function useCreateScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateScenarioInput) => api<Scenario>("POST", "/api/scenarios", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.scenarios }),
  });
}

export function useDeleteScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>("DELETE", `/api/scenarios/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.scenarios }),
  });
}

export function useCreateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAutomationInput) => api<Automation>("POST", "/api/automations", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.automations }),
  });
}

export function useToggleAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api<Automation>("PATCH", `/api/automations/${id}`, { isActive }),
    onSuccess: (a) => {
      qc.setQueryData<Automation[]>(keys.automations, (list) => list?.map((x) => (x.id === a.id ? a : x)));
      void qc.invalidateQueries({ queryKey: keys.automations });
    },
  });
}

export function useDeleteAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>("DELETE", `/api/automations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.automations }),
  });
}

export function useResetDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ message: string }>("POST", "/api/demo/reset"),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDiagnosis() {
  return useMutation({
    mutationFn: (id: number) => api<DiagnosisResponse>("POST", `/api/ai/devices/${id}/diagnosis`),
  });
}

export function useChat() {
  return useMutation({
    mutationFn: (input: { deviceId: number; question: string; history: ChatTurn[] }) =>
      api<ChatResponse>("POST", "/api/ai/chat", input),
  });
}
