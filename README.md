# Premier League Prediction Game

A web-based Premier League prediction game where users can predict match scores and compete on real-time leaderboards.

## Tech Stack

- **Frontend/Backend**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: NextAuth.js with Google OAuth
- **Database**: Supabase (PostgreSQL)
- **External API**: Football-Data.org API v4
- **Deployment**: Vercel (recommended)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Google OAuth credentials
- Supabase project
- Football-Data.org API key

### Installation

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy environment variables:

   ```bash
   cp .env.local.example .env.local
   ```

4. Configure your environment variables in `.env.local`:
   - Set up Google OAuth credentials
   - Configure Supabase connection
   - Add Football-Data.org API key

5. Run the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## Project Structure

```
src/
├── app/          # Next.js App Router pages
├── components/   # Reusable React components
├── lib/          # Utility libraries and configurations
├── types/        # TypeScript type definitions
└── utils/        # Helper functions
```

## Environment Variables

See `.env.local.example` for all required environment variables.

## Contributing

1. Follow the existing code style
2. Run `npm run lint` and `npm run format` before committing
3. Ensure all tests pass

## License

This project is for educational purposes.
