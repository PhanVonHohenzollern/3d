const platformText = () => (typeof navigator === 'undefined' ? '' : navigator.platform || navigator.userAgent);

export const isMacPlatform = /Mac|iPhone|iPad|iPod/i.test(platformText());

export const isWindowsPlatform = /Win/i.test(platformText());
