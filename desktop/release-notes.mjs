export function releaseNotesDecision({
  packaged,
  development,
  currentVersion,
  lastSeenVersion = null,
  existingInstallation = false,
}) {
  if (!packaged || development) {
    return {
      shouldShow: false,
      currentVersion,
      previousVersion: lastSeenVersion,
      shouldAcknowledge: false,
    };
  }

  if (!lastSeenVersion) {
    return {
      shouldShow: existingInstallation,
      currentVersion,
      previousVersion: null,
      shouldAcknowledge: !existingInstallation,
    };
  }

  return {
    shouldShow: lastSeenVersion !== currentVersion,
    currentVersion,
    previousVersion: lastSeenVersion,
    shouldAcknowledge: false,
  };
}
