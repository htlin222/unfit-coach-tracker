import { Spinner, Text, Box } from "@primer/react";

export function LoadingState() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 6, gap: 2 }}>
      <Spinner size="medium" />
      <Text sx={{ color: "fg.muted" }}>載入中…</Text>
    </Box>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Box sx={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: 5,
      color: "danger.fg",
      flexDirection: "column",
      gap: 2,
    }}>
      <Text fontWeight={600}>載入失敗</Text>
      <Text fontSize={0} sx={{ color: "fg.muted" }}>{message}</Text>
    </Box>
  );
}
