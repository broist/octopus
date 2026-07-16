-- Demó-/tesztadatok törlése éles indulás előtt (egyszeri futtatás).
-- A felhasználókat, szerepeket és jogosultságokat NEM bántja.
TRUNCATE task_user, tasks,
         phase_dependencies, project_activities, project_phases,
         document_versions, documents,
         folder_user, folders,
         projects, partners
RESTART IDENTITY CASCADE;

-- Teszt-felhasználó eltávolítása
DELETE FROM model_has_roles WHERE model_type = 'App\Models\User'
  AND model_id IN (SELECT id FROM users WHERE email = 'bela@octopus.local');
DELETE FROM users WHERE email = 'bela@octopus.local';

-- Ellenőrzés
SELECT 'users' AS tabla, count(*) FROM users
UNION ALL SELECT 'projects', count(*) FROM projects
UNION ALL SELECT 'tasks', count(*) FROM tasks
UNION ALL SELECT 'documents', count(*) FROM documents
UNION ALL SELECT 'folders', count(*) FROM folders
UNION ALL SELECT 'partners', count(*) FROM partners;
