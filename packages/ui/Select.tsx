"use client"

import clsx from "clsx"
import React from "react"
import { ArrowDown, CircleArrowDown } from "./icons"

import styles from "./Select.module.scss"

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
  return (
    <div className={clsx(styles.customSelect, className)}>
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
        className={styles.icon}
      />
    </div>
  )
}
