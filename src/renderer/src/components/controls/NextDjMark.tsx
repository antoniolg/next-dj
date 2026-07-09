interface NextDjMarkProps {
  className?: string
}

export function NextDjMark({ className }: NextDjMarkProps): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Clip slash ends flush with the ring's outer edge */}
        <clipPath id="next-dj-disk">
          <circle cx="50" cy="50" r="45" />
        </clipPath>

        {/* Cut slits in the ring where the slashes pass through */}
        <mask id="next-dj-ring-mask">
          <rect width="100" height="100" fill="white" />
          <path d="M8 8 L92 92" stroke="black" strokeWidth="15" strokeLinecap="butt" />
          <path d="M46 64 L94 112" stroke="black" strokeWidth="15" strokeLinecap="butt" />
        </mask>

        {/* Halo gaps around the bars where the slash passes behind */}
        <mask id="next-dj-slash-mask">
          <rect width="100" height="100" fill="white" />
          <path d="M40.5 38V67" stroke="black" strokeLinecap="round" strokeWidth="14" />
          <path d="M50 23V77" stroke="black" strokeLinecap="round" strokeWidth="14" />
          <path d="M59.5 33V62" stroke="black" strokeLinecap="round" strokeWidth="14" />
        </mask>
      </defs>

      <circle cx="50" cy="50" r="41" stroke="currentColor" strokeWidth="8" mask="url(#next-dj-ring-mask)" />

      <g clipPath="url(#next-dj-disk)" mask="url(#next-dj-slash-mask)">
        <path d="M10 10 L90 90" stroke="currentColor" strokeWidth="9" strokeLinecap="butt" />
        <path d="M53.2 70.8 L88 105.6" stroke="currentColor" strokeWidth="9" strokeLinecap="butt" />
      </g>

      <path d="M40.5 38V67" stroke="currentColor" strokeLinecap="round" strokeWidth="7" />
      <path d="M50 23V77" stroke="currentColor" strokeLinecap="round" strokeWidth="7" />
      <path d="M59.5 33V62" stroke="currentColor" strokeLinecap="round" strokeWidth="7" />
    </svg>
  )
}
