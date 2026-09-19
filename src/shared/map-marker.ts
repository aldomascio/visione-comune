export type SharedMapMarkerOptions = {
  ariaLabel: string;
  className?: string;
  testId?: string;
  type?: "button" | "div";
  onClick?: () => void;
};

export function createSharedMapMarkerElement({
  ariaLabel,
  className,
  onClick,
  testId,
  type = onClick ? "button" : "div"
}: SharedMapMarkerOptions): HTMLButtonElement | HTMLDivElement {
  const element = document.createElement(type);
  element.className = className ? `public-map-marker ${className}` : "public-map-marker public-map-marker--category-primary";
  element.setAttribute("aria-label", ariaLabel);

  if (testId) {
    element.dataset.testid = testId;
  }

  if (type === "button") {
    const button = element as HTMLButtonElement;
    button.type = "button";

    if (onClick) {
      button.addEventListener("click", onClick);
      button.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          button.click();
        }
      });
    }
  }

  const inner = document.createElement("span");
  inner.className = "public-map-marker__dot";
  inner.setAttribute("aria-hidden", "true");
  element.append(inner);

  return element;
}
