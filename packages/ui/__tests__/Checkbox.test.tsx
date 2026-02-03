// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import Checkbox from '../Checkbox'
import { PlatformProvider } from '../platform/PlatformProvider'

describe('Checkbox', () => {
  it('renders accessible native input inside a label', async () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    const root = createRoot(div)

    const handleChange = vi.fn()

    await act(async () => {
      root.render(
        <PlatformProvider>
          <Checkbox checked={false} onChange={handleChange} dataTestId="test-checkbox">
            Test Label
          </Checkbox>
        </PlatformProvider>
      )
    })

    // Find the input
    const input = div.querySelector('input')
    expect(input).toBeTruthy()
    expect(input?.getAttribute('type')).toBe('checkbox')

    // Verify it is NOT display: none
    expect(input?.style.display).not.toBe('none')

    // Verify visually hidden styles (approximate check)
    expect(input?.style.position).toBe('absolute')
    expect(input?.style.opacity).toBe('0')

    // Find the label
    const label = div.querySelector('label')
    expect(label).toBeTruthy()

    // Verify label association
    expect(input?.id).toBeTruthy()
    expect(label?.getAttribute('for')).toBe(input?.id)

    // Verify click on input triggers change
    if (input) {
      // Dispatch click event (ensures keyboard/screen reader interaction works)
      input.click()
    }
    expect(handleChange).toHaveBeenCalledWith(true)

    // Clean up
    await act(async () => {
      root.unmount()
    })
    div.remove()
  })
})
