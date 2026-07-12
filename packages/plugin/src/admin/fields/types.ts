/**
 * Props contract for plugin field widgets, as passed by the admin's
 * ContentEditor when a field declares `widget: "bcc:<name>"`. Structural copy
 * of the shape used by first-party plugins — emdash does not export it.
 */
export interface FieldWidgetProps {
	value: unknown;
	onChange: (value: unknown) => void;
	label: string;
	id: string;
	required?: boolean;
	options?: Record<string, unknown>;
	minimal?: boolean;
}
