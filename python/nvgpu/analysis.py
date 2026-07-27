# SPDX-FileCopyrightText: 2026 CERN
# SPDX-License-Identifier: GPL-3.0-or-later

import json
from adaptystanalyser import Module, Identifier


class NvgpuModule(Module):
    def __init__(self, session_id: Identifier,
                 entity: str, node: str):
        """
        Construct an NvgpuModule object.

        :param Identifier session_id: Performance analysis
                                      session information in form
                                      of an Identifier object.
        :param str entity: Name of the entity of a node where
                           the module is attached.
        :param str node: Name of the node where the module is
                         attached.
        """
        self._path = session_id.get_detailed_path(entity, node,
                                                  self.get_name())
        self._regions = None

    def get_name(self):
        return 'nvgpu'

    @Module.needs_loading
    def get_cuda_api_calls(self, region: str):
        """
        Get CUDA API tracing results for a given code region
        in form of a summary dictionary of the following structure:
        {
          "<CUDA API method name>": {
            "length": <exact method runtime in ns>,
            "children": <dictionary of CUDA API calls made
                         by the method: the format is the same
                         as for the root>
          }
        }

        If the region does not exist, None is returned.

        :param str region: Name of a code region for which the
                           tracing results should be obtained.
        """
        if region not in self._regions:
            return None

        return self._regions[region]['data']

    @Module.needs_loading
    def get_region_names(self):
        """
        Get the list of all code region names of a nvgpu
        performance analysis session.
        """
        return list(self._regions.keys())

    @Module.needs_loading
    def get_regions(self):
        """
        Get CUDA API tracing results in form of a summary
        dictionary of the following structure:
        {
          "<code region>": {
            "data": {
              "<CUDA API method name>": {
                "length": <exact method runtime in ns>,
                "children": <dictionary of CUDA API calls made
                             by the method: the format is the same
                             as for "data">
              }
            }
          }
        }
        """
        return self._regions

    def process_post_request(self, data):
        """
        Please see the REST API documentation of the nvgpu
        module for the structure of POST requests here.
        """
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
