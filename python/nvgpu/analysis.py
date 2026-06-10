# SPDX-FileCopyrightText: 2026 CERN
# SPDX-License-Identifier: GPL-3.0-or-later

import json
from adaptystanalyser import Module, Identifier


class NvgpuModule(Module):
    def __init__(self, session_id: Identifier,
                 entity: str, node: str):
        self._path = session_id.path / 'system' / entity / \
            node / 'nvgpu'
        self._regions = None

    def get_name(self):
        return 'nvgpu'

    @Module.needs_loading
    def get_regions(self):
        return self._regions

    def process_post_request(self, data):
        if 'regions' in data:
            regions = self.get_regions()

            if regions is None:
                return '', 404

            return json.dumps(regions)
        else:
            return '', 400

    def _load(self):
        path = self._path / 'regions.json'

        if path.exists():
            with path.open(mode='r') as f:
                self._regions = json.load(f)


def get_mod_obj(session_id, entity, analysable, options):
    return NvgpuModule(session_id, entity, analysable)
