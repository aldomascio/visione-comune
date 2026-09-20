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
  element.className = className ? `public-map-marker ${className}` : "public-map-marker";
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

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("class", "public-map-marker__icon");
  icon.setAttribute("viewBox", "0 0 24 24");

  const pin = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pin.setAttribute("d", "M12 22s7-6.1 7-13a7 7 0 1 0-14 0c0 6.9 7 13 7 13Z");
  pin.setAttribute("class", "public-map-marker__shape");

  const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  dot.setAttribute("cx", "12");
  dot.setAttribute("cy", "9");
  dot.setAttribute("r", "2.75");
  dot.setAttribute("class", "public-map-marker__dot");

  icon.append(pin, dot);
  element.append(icon);

  return element;
}
