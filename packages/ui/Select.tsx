"use client"

import React from "react"
import { CircleArrowDown } from "./icons"

import { Div } from "./platform"
import { useSelectStyles } from "./Select.styles"

export default function Select({
  className,
  options,
  defaultValue,
  value,
  name,
  onChange,
  style,
  id,
  ...rest
}: {
  name?: string
  id?: string
  className?: string
  value?: string
  options: { value: string; label: string }[]
  defaultValue?: string
  style?: React.CSSProperties
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
}) {
  const styles = useSelectStyles()
  return (
    <Div style={{ ...styles.customSelect.style, ...style }}>
      <select
        name={name}
        id={id}
        style={style}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <CircleArrowDown
        size={15}
        color="var(--shade-6)"
        style={styles.icon.style}
      />
    </Div>
  )
}
