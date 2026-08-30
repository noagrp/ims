(() => {
  if (window.__IMS_MOVEMENT_REFRESH_NORMALIZER__) return;
  window.__IMS_MOVEMENT_REFRESH_NORMALIZER__ = true;

  const originalAlert = window.alert.bind(window);

  window.alert = message => {
    const text = String(message ?? '');
    originalAlert(message);

    const maintenanceStarted = text === 'Maintenance movement started.';
    const maintenanceReturnStarted = text.startsWith('Return started. Arrival status:');

    if (maintenanceStarted || maintenanceReturnStarted) {
      window.location.reload();
    }
  };
})();
