import { RemoteTable } from "@/components/table/RemoteTable";

export default async function TablePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RemoteTable code={code} />;
}
