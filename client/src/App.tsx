import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Redirect, Route, Switch } from "wouter";
import { PhoneFrame } from "@/components/PhoneFrame";
import { queryClient } from "@/lib/queries";
import Automations from "@/pages/Automations";
import DeviceDetail from "@/pages/DeviceDetail";
import Devices from "@/pages/Devices";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import RoomDetail from "@/pages/RoomDetail";
import Scenarios from "@/pages/Scenarios";
import Settings from "@/pages/Settings";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PhoneFrame>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/devices" component={Devices} />
          <Route path="/scenarios" component={Scenarios} />
          <Route path="/automations" component={Automations} />
          <Route path="/settings" component={Settings} />
          <Route path="/profile">
            <Redirect to="/settings" replace />
          </Route>
          <Route path="/room/:id" component={RoomDetail} />
          <Route path="/device/:id" component={DeviceDetail} />
          <Route component={NotFound} />
        </Switch>
      </PhoneFrame>
      <Toaster position="top-center" richColors closeButton toastOptions={{ duration: 4000 }} />
    </QueryClientProvider>
  );
}
