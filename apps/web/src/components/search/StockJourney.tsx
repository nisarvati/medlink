"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const steps = [
  { number: "01", title: "A pharmacy updates its shelf", copy: "A sale, restock or price change is recorded by the pharmacy's own system." },
  { number: "02", title: "MedLink receives the change", copy: "The update travels through the pharmacy connection to the live stock service." },
  { number: "03", title: "You compare nearby options", copy: "Search brings together stock, price and distance, with a clear label for older figures." },
];

export function StockJourney() {
  const root = useRef<HTMLElement>(null);

  useGSAP(() => {
    if (typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const cards = gsap.utils.toArray<HTMLElement>("[data-journey-card]", root.current);
    const mm = gsap.matchMedia();
    mm.add("(min-width: 900px)", () => {
      cards.forEach((card, index) => {
        gsap.fromTo(card, { y: 72, opacity: 0.55, scale: 0.96 }, {
          y: index * -8,
          opacity: 1,
          scale: 1,
          ease: "none",
          scrollTrigger: { trigger: card, start: "top 82%", end: "top 42%", scrub: true },
        });
      });
      ScrollTrigger.create({ trigger: root.current, start: "top top+=120", end: "bottom bottom-=120", pin: "[data-journey-title]", pinSpacing: false });
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <section ref={root} className="journey-section" aria-labelledby="journey-title">
      <div className="journey-intro" data-journey-title>
        <p className="section-kicker">Behind the number</p>
        <h2 id="journey-title" className="editorial-title">Stock you can understand.</h2>
        <p>Availability starts at the pharmacy. We show where the figure came from, so you can decide what to do next.</p>
      </div>
      <ol className="journey-steps">
        {steps.map((step) => (
          <li key={step.number} data-journey-card>
            <span className="journey-number" aria-hidden="true">{step.number}</span>
            <div><h3>{step.title}</h3><p>{step.copy}</p></div>
            <span className="journey-mark" aria-hidden="true">↗</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
