package com.focuslift.service;

import com.focuslift.domain.enums.Role;
import com.focuslift.domain.model.User;
import com.focuslift.domain.model.Workout;
import com.focuslift.dto.sync.*;
import com.focuslift.repository.DailyHabitRepository;
import com.focuslift.repository.RoutineRepository;
import com.focuslift.repository.SyncTombstoneRepository;
import com.focuslift.repository.WorkoutRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SyncServiceTest {

    @Mock
    private WorkoutRepository workoutRepository;

    @Mock
    private RoutineRepository routineRepository;

    @Mock
    private DailyHabitRepository dailyHabitRepository;

    @Mock
    private SyncTombstoneRepository tombstoneRepository;

    private SyncService syncService;
    private User testUser;

    @BeforeEach
    void setUp() {
        syncService = new SyncService(workoutRepository, routineRepository, dailyHabitRepository, tombstoneRepository);
        testUser = new User("atleta@focuslift.test", "hash123", "Atleta Teste", Role.USER);
    }

    @Test
    @DisplayName("Deve processar push de treinos, hábitos e tombstones com sucesso")
    void testPushSync_Success() {
        WorkoutSyncDto workoutDto = new WorkoutSyncDto(
                1L,
                "workout-local-1",
                "Treino A",
                "2026-11-06",
                "Foco em peito",
                BigDecimal.valueOf(1500.0),
                List.of(
                        new ExerciseSyncDto(
                                1L,
                                "Supino Reto",
                                "Peito",
                                90,
                                0,
                                List.of(new SetSyncDto(1L, BigDecimal.valueOf(80.0), 10, BigDecimal.valueOf(8.5), "normal", "2026-11-06T10:00:00Z", 0))
                        )
                ),
                "2026-11-06T10:30:00Z"
        );

        HabitSyncDto habitDto = new HabitSyncDto(
                1L,
                "2026-11-06",
                1, 1, 1, 1, 5, 2500, 3000, 160, 160
        );

        TombstoneSyncDto tombstoneDto = new TombstoneSyncDto("workout", "workout-local-99", "2026-11-06T10:00:00Z");

        when(workoutRepository.findByUserAndClientUuid(testUser, "workout-local-1")).thenReturn(Optional.empty());
        when(workoutRepository.findByUserAndClientUuid(testUser, "workout-local-99")).thenReturn(Optional.of(new Workout(testUser, "workout-local-99", "Treino Excluido", "2026-11-05", "", BigDecimal.ZERO)));

        SyncPushRequest request = new SyncPushRequest(
                List.of(workoutDto),
                List.of(),
                List.of(habitDto),
                List.of(tombstoneDto)
        );

        SyncPushResponse response = syncService.pushSync(testUser, request);

        assertTrue(response.success());
        assertEquals(1, response.workoutsSaved());
        assertEquals(1, response.habitsSaved());
        assertEquals(1, response.tombstonesProcessed());
        verify(workoutRepository, times(1)).save(any(Workout.class));
        verify(workoutRepository, times(1)).delete(any(Workout.class));
    }

    @Test
    @DisplayName("Deve deletar workout mesmo se tombstone não tiver prefixo workout-local-")
    void testPushSync_TombstoneWithoutPrefix() {
        TombstoneSyncDto tombstoneDto = new TombstoneSyncDto("workout", "42", "2026-11-06T10:00:00Z");
        Workout existing = new Workout(testUser, "workout-local-42", "Treino Antigo", "2026-11-04", "", BigDecimal.ZERO);

        when(workoutRepository.findByUserAndClientUuid(testUser, "42")).thenReturn(Optional.empty());
        when(workoutRepository.findByUserAndClientUuid(testUser, "workout-local-42")).thenReturn(Optional.of(existing));

        SyncPushRequest request = new SyncPushRequest(
                List.of(),
                List.of(),
                List.of(),
                List.of(tombstoneDto)
        );

        SyncPushResponse response = syncService.pushSync(testUser, request);

        assertTrue(response.success());
        assertEquals(1, response.tombstonesProcessed());
        verify(workoutRepository, times(1)).delete(existing);
    }
}
