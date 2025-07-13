require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001;

// Verify TMDB API key is present
if (!process.env.TMDB_API_KEY) {
    console.error('TMDB_API_KEY is not set in .env file');
    process.exit(1);
}

app.use(cors());
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// API routes
// TMDB API configuration
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Genre mapping
const genres = {
    action: 28,
    comedy: 35,
    drama: 18,
    horror: 27,
    romance: 10749,
    sciFi: 878,
    thriller: 53,
    animation: 16,
    documentary: 99,
    fantasy: 14,
    mystery: 9648
};

// Language mapping
const languages = {
    english: 'en-US',
    spanish: 'es-ES',
    french: 'fr-FR',
    german: 'de-DE',
    hindi: 'hi-IN',
    japanese: 'ja-JP',
    korean: 'ko-KR',
    italian: 'it-IT',
    portuguese: 'pt-BR',
    russian: 'ru-RU'
};

// Get random movies by genre and language
app.get('/api/movies', async (req, res) => {
    try {
        const { genre, language, rating } = req.query;
        console.log('Received request with params:', { genre, language, rating });
        
        if (!genre || !language) {
            console.log('Missing required parameters');
            return res.status(400).json({ error: 'Genre and language are required' });
        }

        const genreId = genres[genre.toLowerCase()];
        const languageCode = languages[language.toLowerCase()];

        if (!genreId || !languageCode) {
            console.log('Invalid genre or language:', { genre, language });
            return res.status(400).json({ error: 'Invalid genre or language' });
        }

        // Build query parameters
        const params = {
            api_key: TMDB_API_KEY,
            with_genres: genreId,
            language: languageCode,
            sort_by: 'popularity.desc',
            include_adult: false,
            page: Math.floor(Math.random() * 5) + 1
        };

        // Add rating filter if provided
        if (rating) {
            params['vote_average.gte'] = rating;
        }

        console.log('Fetching from TMDB with params:', params);

        // Fetch movies from TMDB
        const response = await axios.get(`${TMDB_BASE_URL}/discover/movie`, { params });
        console.log(`Received ${response.data.results.length} movies from TMDB`);

        // Get 5 random movies from the response
        const movies = response.data.results;
        if (movies.length === 0) {
            return res.status(404).json({ error: 'No movies found matching your criteria' });
        }

        const randomMovies = [];
        const numMovies = Math.min(5, movies.length); // Get 5 movies

        while (randomMovies.length < numMovies) {
            const randomIndex = Math.floor(Math.random() * movies.length);
            const movie = movies[randomIndex];
            
            // Check if movie is not already selected
            if (!randomMovies.find(m => m.id === movie.id)) {
                try {
                    // Fetch additional movie details
                    const detailsResponse = await axios.get(`${TMDB_BASE_URL}/movie/${movie.id}`, {
                        params: {
                            api_key: TMDB_API_KEY,
                            language: languageCode,
                            append_to_response: 'credits,videos'
                        }
                    });

                    const details = detailsResponse.data;
                    
                    randomMovies.push({
                        id: movie.id,
                        title: movie.title,
                        year: movie.release_date.split('-')[0],
                        image: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
                        backdrop: `https://image.tmdb.org/t/p/original${movie.backdrop_path}`,
                        overview: movie.overview,
                        rating: movie.vote_average,
                        runtime: details.runtime,
                        genres: details.genres.map(g => g.name),
                        director: details.credits.crew.find(person => person.job === 'Director')?.name,
                        cast: details.credits.cast.slice(0, 5).map(person => person.name),
                        trailer: details.videos.results.find(video => video.type === 'Trailer')?.key
                    });
                } catch (error) {
                    console.error(`Error fetching details for movie ${movie.id}:`, error.message);
                }
            }
        }

        console.log(`Returning ${randomMovies.length} movie suggestions`);
        res.json(randomMovies);
    } catch (error) {
        console.error('Error in /api/movies:', error.message);
        res.status(500).json({ error: 'Failed to fetch movies', details: error.message });
    }
});

// Get available genres
app.get('/api/genres', (req, res) => {
    console.log('Fetching available genres');
    res.json(Object.keys(genres));
});

// Get available languages
app.get('/api/languages', (req, res) => {
    console.log('Fetching available languages');
    res.json(Object.keys(languages));
});

// Get trending movies
app.get('/api/trending', async (req, res) => {
    try {
        console.log('Fetching trending movies');
        const response = await axios.get(`${TMDB_BASE_URL}/trending/movie/week`, {
            params: {
                api_key: TMDB_API_KEY
            }
        });

        const trendingMovies = response.data.results.slice(0, 10).map(movie => ({
            id: movie.id,
            title: movie.title,
            image: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
            rating: movie.vote_average
        }));

        console.log(`Returning ${trendingMovies.length} trending movies`);
        res.json(trendingMovies);
    } catch (error) {
        console.error('Error fetching trending movies:', error.message);
        res.status(500).json({ error: 'Failed to fetch trending movies', details: error.message });
    }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log('TMDB API Key is configured:', TMDB_API_KEY ? 'Yes' : 'No');
}); 