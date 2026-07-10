<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'phone' => fake()->optional()->phoneNumber(),
            'job_title' => fake()->optional()->jobTitle(),
            'locale' => 'hu',
            'is_active' => true,
            'is_external' => false,
            'remember_token' => Str::random(10),
        ];
    }

    public function external(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_external' => true,
        ]);
    }
}
