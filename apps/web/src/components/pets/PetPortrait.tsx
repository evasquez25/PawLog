export function PetPortrait({ cat = false, petName }: { cat?: boolean; petName?: string }) {
  return (
    <svg
      viewBox="0 0 240 240"
      role="img"
      aria-label={
        petName
          ? `Pet illustration for ${petName}`
          : cat
            ? 'Friendly cat illustration'
            : 'Friendly dog illustration'
      }
    >
      <circle cx="120" cy="120" r="112" fill="#e8ddbc" />
      <path d="M44 240c3-55 40-78 76-78s73 23 76 78" fill={cat ? '#9b9d96' : '#d5a052'} />
      {cat ? (
        <path d="M62 105 57 42l49 33h29l48-33-5 71" fill="#92978c" />
      ) : (
        <>
          <path d="M80 70C26 57 20 157 55 166c21 3 35-47 38-66" fill="#ad7136" />
          <path d="M160 70c54-13 60 87 25 96-21 3-35-47-38-66" fill="#ad7136" />
        </>
      )}
      <path
        d="M66 110c0-63 108-63 108 0v30c0 69-108 69-108 0Z"
        fill={cat ? '#b9bdb2' : '#edbf77'}
      />
      <path d="M84 141c0-20 72-20 72 0 0 42-72 42-72 0" fill={cat ? '#e0e2d9' : '#f8dbab'} />
      <ellipse cx="92" cy="115" rx="6" ry="8" fill="#342f28" />
      <ellipse cx="148" cy="115" rx="6" ry="8" fill="#342f28" />
      <path d="M109 137q11-8 22 0-1 12-11 12t-11-12" fill="#453a30" />
      <path
        d="M106 154q14 13 28 0"
        fill="none"
        stroke="#453a30"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {!cat && <path d="M114 163h14v10c0 13-14 13-14 0" fill="#c97267" />}
      <path d="M78 187q42 20 84 0" stroke="#60765b" strokeWidth="12" fill="none" />
      <circle cx="120" cy="204" r="10" fill="#e8bb61" />
      <path d="m119 199 2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1Z" fill="#f8e8bc" />
    </svg>
  );
}
