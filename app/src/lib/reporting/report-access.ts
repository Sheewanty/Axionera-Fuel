export function resolveReportStationId(input: {
  requestedStationId?: string;
  membershipStationId: string;
  templateStationScoped: boolean;
}): string | undefined {
  const requested = input.requestedStationId?.trim() || undefined;

  if (input.membershipStationId !== "") {
    return requested ?? input.membershipStationId;
  }

  if (input.templateStationScoped) {
    return requested;
  }

  return requested;
}
