interface YouTubeImportFormProps {
  disabled: boolean
  status: string | null
  url: string
  onSubmit: () => void
  onUrlChange: (url: string) => void
}

export function YouTubeImportForm({
  disabled,
  status,
  url,
  onSubmit,
  onUrlChange
}: YouTubeImportFormProps): JSX.Element {
  return (
    <form
      className="youtube-import"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <input
        aria-label="YouTube Music playlist URL"
        disabled={disabled}
        placeholder="Paste YouTube Music playlist URL"
        type="url"
        value={url}
        onChange={(event) => onUrlChange(event.currentTarget.value)}
      />
      <button disabled={disabled || url.trim().length === 0} type="submit">
        {disabled ? 'Reading' : 'Import'}
      </button>
      {status ? <span className="youtube-import-status">{status}</span> : null}
    </form>
  )
}
