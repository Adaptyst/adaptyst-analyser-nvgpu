# SPDX-FileCopyrightText: 2025 CERN
# SPDX-License-Identifier: GPL-3.0-or-later

import json
import traceback
import sys
from pathlib import Path


def process(storage, identifier, entity, node, data):
    if 'regions' in data:
        try:
            path = Path(storage) / identifier / 'system' \
                / entity / node / 'nvgpu' / 'regions.json'

            if not path.exists():
                return '', 404

            with path.open(mode='r') as f:
                regions = json.load(f)

            return json.dumps(regions)
        except Exception:
            traceback.print_exc()
            return '', 500
    else:
        return '', 400
