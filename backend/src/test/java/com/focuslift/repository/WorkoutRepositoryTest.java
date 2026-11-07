package com.focuslift.repository;

import com.focuslift.domain.enums.Role;
import com.focuslift.domain.enums.SetType;
import com.focuslift.domain.model.Exercise;
import com.focuslift.domain.model.User;
import com.focuslift.domain.model.Workout;
import com.focuslift.domain.model.WorkoutSet;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
class WorkoutRepositoryTest {

    @Autowired
    private WorkoutRepository workoutRepository;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    @DisplayName("Deve carregar treinos com exercícios e séries em lote sem MultipleBagFetchException")
    void testFindWorkoutsWithDetailsNoMultipleBagFetch() {
        User user = new User("atleta@focuslift.com", "hashpass", "Atleta Teste", Role.USER);
        user = entityManager.persistAndFlush(user);

        Workout workout = new Workout(user, "w-uuid-1", "Treino A - Peito", "2026-11-06", "Notas de teste", BigDecimal.valueOf(3000));

        Exercise ex1 = new Exercise("Supino Reto", "Peito", 90, 0);
        ex1.addSet(new WorkoutSet(BigDecimal.valueOf(80), 10, BigDecimal.valueOf(8.5), SetType.NORMAL, null, 0));
        ex1.addSet(new WorkoutSet(BigDecimal.valueOf(85), 8, BigDecimal.valueOf(9.0), SetType.NORMAL, null, 1));
        workout.addExercise(ex1);

        Exercise ex2 = new Exercise("Crucifixo", "Peito", 60, 1);
        ex2.addSet(new WorkoutSet(BigDecimal.valueOf(16), 12, BigDecimal.valueOf(8.0), SetType.NORMAL, null, 0));
        workout.addExercise(ex2);

        entityManager.persistAndFlush(workout);
        entityManager.clear(); // Limpa o cache de primeiro nível para forçar consulta ao banco

        List<Workout> recent = workoutRepository.findRecentWorkoutsWithDetails(user, "2026-11-01");
        assertThat(recent).hasSize(1);
        Workout loaded = recent.get(0);
        assertThat(loaded.getExercises()).hasSize(2);
        assertThat(loaded.getExercises().get(0).getSets()).hasSize(2);

        List<Workout> all = workoutRepository.findAllWorkoutsWithDetails(user);
        assertThat(all).hasSize(1);
    }
}
