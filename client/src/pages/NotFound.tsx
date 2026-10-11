import { PageHeader } from "@/components/PageHeader";
import { NotFoundState } from "@/components/states";

export default function NotFound() {
  return (
    <>
      <PageHeader title="Not found" />
      <NotFoundState what="Page" />
    </>
  );
}
