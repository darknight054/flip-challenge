import type { Metadata } from "next";
import { AlgorithmExplainer } from "@/components/algorithm-explainer";

export const metadata: Metadata = { title: "How it works" };

export default function AlgorithmPage() {
  return <AlgorithmExplainer />;
}
