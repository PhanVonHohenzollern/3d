export const preventDefault = (event: { preventDefault(): void }): void => event.preventDefault();

export const stopPropagation = (event: { stopPropagation(): void }): void => event.stopPropagation();
