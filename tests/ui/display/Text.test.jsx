import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Eyebrow, FieldLabel, Muted } from '../../../src/ui/display/Text';

describe('Text', () => {
  it('Eyebrow renders a stamp-colored uppercase label', () => {
    render(<Eyebrow>Field Notes</Eyebrow>);
    expect(screen.getByText('Field Notes')).toHaveClass('text-stamp', 'uppercase');
  });

  it('FieldLabel renders an actual <label> for the given field', () => {
    render(
      <>
        <FieldLabel htmlFor="group-name">Group name</FieldLabel>
        <input id="group-name" />
      </>,
    );
    expect(screen.getByLabelText('Group name')).toBeInTheDocument();
  });

  it('Muted renders soft-toned body text', () => {
    render(<Muted>Select any parcel on the map.</Muted>);
    expect(screen.getByText('Select any parcel on the map.')).toHaveClass('text-ink-soft');
  });
});
