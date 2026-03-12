import { RecommendationApp } from "@/components/recommendation-app";
import { isAdminConsoleEnabled } from "@/lib/server-flags";

export default function HomePage() {
  return <RecommendationApp adminConsoleEnabled={isAdminConsoleEnabled()} />;
}
