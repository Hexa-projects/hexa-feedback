import HexaLayout from "@/components/HexaLayout";
import ApiDocsContent from "@/components/ApiDocsContent";

export default function ApiDocsPage() {
  return (
    <HexaLayout>
      <div className="animate-slide-up">
        <ApiDocsContent />
      </div>
    </HexaLayout>
  );
}
