# Business API Routes

This directory contains all API routes related to business features (equity, financial planning, etc.) that are separate from the core fitness functionality.

## Structure

```
/api/business/
├── equity/
│   ├── calculate/route.ts    # Equity calculations
│   ├── save/route.ts         # Save equity configurations
│   └── export/route.ts       # Export equity data
├── financial/
│   ├── projections/route.ts  # Revenue projections
│   └── reports/route.ts      # Financial reports
└── README.md
```

## Guidelines

1. All business-related API routes should be placed here
2. Keep fitness/workout related APIs in the main `/api` directory
3. Use consistent naming: `noun/verb/route.ts`
4. Add authentication middleware when needed

## Example Routes

- `/api/business/equity/calculate` - Calculate equity distributions
- `/api/business/equity/save` - Save equity structure to database
- `/api/business/financial/projections` - Generate financial projections