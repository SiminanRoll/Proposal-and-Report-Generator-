# Version 1.0.3.15

## Pre-meeting HIPAA form alignment

- Corrected displaced AcroForm fields in the pre-meeting HIPAA packet.
- Form geometry is now measured from the exact cloned page and wrapper used to render the PDF background.
- This prevents wrapper-specific flex or grid CSS from producing coordinates that do not match the printed field boxes.
- Added an explicit block-layout safeguard for pre-meeting pages during PDF capture.
- Softened the saved PDF field border and kept the field background white so the controls blend into the document more naturally.

The questions, response choices, and notes fields remain fillable.
