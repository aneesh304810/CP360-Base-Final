from scd2lens.ingest.loader import REQUIRED, load_export


def test_all_frames_load_with_required_columns(export):
    assert not export.missing
    for name, req in REQUIRED.items():
        df = export.frames[name]
        assert set(req) <= set(df.columns), name
    assert export.scenario_tasks["code_chars"].dtype.kind in "iu"
    assert (export.scenario_tasks["code_preview"].str.len() > 0).all()


def test_missing_file_is_recorded_not_invented(tmp_path):
    ex = load_export(tmp_path)
    assert set(ex.missing) == set(REQUIRED)
    assert ex.scenario_tasks.empty and list(ex.scenario_tasks.columns) == REQUIRED["scenario_tasks"]
