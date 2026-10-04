import { BrowseIcon } from './icons'

interface Props {
  value: string
  placeholder: string
  browseLabel: string
  onBrowse: () => void
}

export default function PathPickerInput({ value, placeholder, browseLabel, onBrowse }: Props) {
  return (
    <div className="path-picker-input" onClick={onBrowse}>
      <span className="path-picker-icon" aria-hidden="true">
        <BrowseIcon size={18} />
      </span>
      <input
        value={value}
        readOnly
        placeholder={placeholder}
        aria-label={browseLabel}
        title={value || placeholder}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onBrowse()
          }
        }}
      />
    </div>
  )
}
