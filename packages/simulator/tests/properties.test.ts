import { describe, it, expect, beforeEach } from 'vitest';
import { createPropertiesServiceMock } from '../src/mocks/properties';

describe('PropertiesService mock', () => {
  let svc: ReturnType<typeof createPropertiesServiceMock>;

  beforeEach(() => {
    svc = createPropertiesServiceMock();
  });

  it('getProperty returns null for missing key', () => {
    expect(svc.getScriptProperties().getProperty('missing')).toBeNull();
  });

  it('setProperty + getProperty round-trips', () => {
    const props = svc.getScriptProperties();
    props.setProperty('key', 'value');
    expect(props.getProperty('key')).toBe('value');
  });

  it('setProperty overwrites existing value', () => {
    const props = svc.getScriptProperties();
    props.setProperty('key', 'v1');
    props.setProperty('key', 'v2');
    expect(props.getProperty('key')).toBe('v2');
  });
});
