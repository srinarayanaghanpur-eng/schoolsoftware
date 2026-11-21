import { notFound } from "next/navigation";
import { MasterCrudPage } from "@/components/MasterCrudPage";
import { getMasterConfig } from "@/lib/masterConfig";

export default function MasterPage({ params }: { params: { master: string } }) {
  const config = getMasterConfig(params.master);
  if (!config) notFound();
  return <MasterCrudPage config={config} />;
}
